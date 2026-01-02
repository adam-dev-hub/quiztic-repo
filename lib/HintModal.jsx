import React, { useEffect, useRef } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Animated, Platform } from 'react-native';

const HintModal = ({ visible, onClose, hintText, colors, textSizeMultiplier = 1 }) => {
  const progress = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      progress.setValue(1);
      const anim = Animated.timing(progress, {
        toValue: 0,
        duration: 10000,
        useNativeDriver: false,
      });
      anim.start(({ finished }) => {
        if (finished) onClose?.();
      });
      return () => progress.stopAnimation();
    }
  }, [visible, onClose, progress]);

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Modal
      visible={!!visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      {...(Platform.OS === 'ios'
        ? { presentationStyle: 'overFullScreen' }
        : { statusBarTranslucent: true })}
    >
      <View style={styles.overlay}>
        <View style={[styles.alertBox, { backgroundColor: colors?.cardBackground || '#fff' }]}>
          <Text style={[styles.alertTitle, { color: colors?.text || '#000', fontSize: 20 * textSizeMultiplier }]}>Hint</Text>

          <Text style={[styles.alertMessage, { color: colors?.secondaryText || '#444', fontSize: 16 * textSizeMultiplier }]}>
            {hintText}
          </Text>

          <View style={styles.progressContainer}>
            <Animated.View style={[styles.progressBar, { width: progressWidth, backgroundColor: colors?.primary || '#6c5ce7' }]} />
          </View>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors?.primary || '#6c5ce7' }]}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={[styles.buttonText, { color: '#fff' }]}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  alertBox: {
    maxWidth: 480,
    width: '85%',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  alertTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  alertMessage: {
    textAlign: 'center',
    marginBottom: 16,
  },
  progressContainer: {
    width: '100%',
    height: 8,
    backgroundColor: '#ddd',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBar: {
    height: '100%',
  },
  button: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  buttonText: {
    fontWeight: 'bold',
  },
});

export default HintModal;
