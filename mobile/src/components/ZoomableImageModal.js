import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  PanResponder,
  Dimensions,
  FlatList,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const touchDistance = (touches) => {
  const [a, b] = touches;
  return Math.sqrt(Math.pow(a.pageX - b.pageX, 2) + Math.pow(a.pageY - b.pageY, 2));
};

// Una sola foto, con pellizco para zoom / doble toque / arrastre cuando está
// ampliada. Cuando NO está ampliada, un swipe horizontal de un dedo se deja
// pasar (el PanResponder no lo reclama) para que el FlatList de la galería
// pueda pasar a la siguiente foto.
function ZoomableImage({ uri, onClose, onZoomChange }) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const scaleRef = useRef(1);
  const translateRef = useRef({ x: 0, y: 0 });
  const gesture = useRef({
    initialDistance: 0,
    initialScale: 1,
    initialTranslate: { x: 0, y: 0 },
    tapTimer: null,
  }).current;

  useEffect(() => () => {
    if (gesture.tapTimer) clearTimeout(gesture.tapTimer);
  }, []);

  const applyScale = (v) => { scaleRef.current = v; scale.setValue(v); };
  const applyTranslate = (x, y) => {
    translateRef.current = { x, y };
    translateX.setValue(x);
    translateY.setValue(y);
  };

  const resetZoom = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: false }),
      Animated.spring(translateX, { toValue: 0, useNativeDriver: false }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: false }),
    ]).start();
    scaleRef.current = 1;
    translateRef.current = { x: 0, y: 0 };
    onZoomChange?.(false);
  };

  const zoomIn = () => {
    Animated.spring(scale, { toValue: 2.5, useNativeDriver: false }).start();
    scaleRef.current = 2.5;
    onZoomChange?.(true);
  };

  const panResponder = useRef(
    PanResponder.create({
      // A escala normal (sin zoom) con un solo dedo, este view NO reclama el
      // gesto — así el FlatList padre puede hacer swipe a la siguiente foto.
      onStartShouldSetPanResponder: (evt) => evt.nativeEvent.touches.length === 2,
      onMoveShouldSetPanResponder: (evt) =>
        evt.nativeEvent.touches.length === 2 || scaleRef.current > 1.01,
      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length === 2) {
          gesture.initialDistance = touchDistance(touches);
          gesture.initialScale = scaleRef.current;
        } else {
          gesture.initialTranslate = { ...translateRef.current };
        }
      },
      onPanResponderMove: (evt, g) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length === 2) {
          if (!gesture.initialDistance) {
            gesture.initialDistance = touchDistance(touches);
            gesture.initialScale = scaleRef.current;
          }
          const dist = touchDistance(touches);
          const next = clamp(gesture.initialScale * (dist / gesture.initialDistance), 1, 5);
          applyScale(next);
          onZoomChange?.(next > 1.01);
        } else if (touches.length === 1 && scaleRef.current > 1.01) {
          const maxX = ((scaleRef.current - 1) * SCREEN_W) / 2;
          const maxY = ((scaleRef.current - 1) * SCREEN_H) / 2;
          applyTranslate(
            clamp(gesture.initialTranslate.x + g.dx, -maxX, maxX),
            clamp(gesture.initialTranslate.y + g.dy, -maxY, maxY)
          );
        }
      },
      onPanResponderRelease: () => {
        gesture.initialDistance = 0;
        if (scaleRef.current < 1) resetZoom();
        else onZoomChange?.(scaleRef.current > 1.01);
      },
    })
  ).current;

  const onTap = () => {
    if (gesture.tapTimer) {
      clearTimeout(gesture.tapTimer);
      gesture.tapTimer = null;
      if (scaleRef.current > 1.01) resetZoom(); else zoomIn();
    } else {
      gesture.tapTimer = setTimeout(() => {
        gesture.tapTimer = null;
        if (scaleRef.current <= 1.01) onClose();
      }, 250);
    }
  };

  return (
    <View style={s.zoomArea} {...panResponder.panHandlers}>
      <TouchableWithoutFeedback onPress={onTap}>
        <Animated.Image
          source={{ uri }}
          style={[s.image, { transform: [{ translateX }, { translateY }, { scale }] }]}
          resizeMode="contain"
        />
      </TouchableWithoutFeedback>
    </View>
  );
}

export default function ZoomableImageModal({ visible, uri, images, initialIndex = 0, onClose }) {
  const gallery = images && images.length ? images : uri ? [uri] : [];
  const [index, setIndex] = useState(initialIndex);
  const [zoomed, setZoomed] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setIndex(initialIndex);
      setZoomed(false);
    }
  }, [visible, initialIndex]);

  if (!gallery.length) return null;

  const onMomentumEnd = (e) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    setIndex(i);
    setZoomed(false);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <FlatList
          ref={listRef}
          data={gallery}
          keyExtractor={(item, i) => `${item}-${i}`}
          horizontal
          pagingEnabled
          scrollEnabled={!zoomed}
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
          onMomentumScrollEnd={onMomentumEnd}
          renderItem={({ item }) => (
            <View style={{ width: SCREEN_W }}>
              <ZoomableImage uri={item} onClose={onClose} onZoomChange={setZoomed} />
            </View>
          )}
        />

        <TouchableOpacity style={s.closeBtn} onPress={onClose}>
          <Ionicons name="close" size={22} color="#fff" />
        </TouchableOpacity>

        {gallery.length > 1 && (
          <View style={s.counter}>
            <Text style={s.counterText}>{index + 1} / {gallery.length}</Text>
          </View>
        )}

        <Text style={s.hint}>
          {gallery.length > 1
            ? 'Desliza para ver la siguiente · pellizca para zoom · doble toque para ampliar'
            : 'Pellizca para zoom · doble toque para ampliar · toca para cerrar'}
        </Text>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
  },
  zoomArea: { width: SCREEN_W, height: SCREEN_H * 0.85, alignItems: 'center', justifyContent: 'center' },
  image: { width: '95%', height: '100%' },
  closeBtn: {
    position: 'absolute',
    top: 48,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    position: 'absolute',
    top: 56,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  counterText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  hint: {
    position: 'absolute',
    bottom: 28,
    alignSelf: 'center',
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
