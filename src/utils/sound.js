import { Audio } from 'expo-av';

let sounds = {};

export const loadSound = async (key, file) => {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,  
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });

    const { sound } = await Audio.Sound.createAsync(file);
    sounds[key] = sound;
    console.log("Sound loaded:", key);
  } catch (error) {
    console.log("Sound load error:", error);
  }
};

export const playSound = async (key) => {
  const sound = sounds[key];
  if (!sound) {
    console.log("Sound not loaded:", key);
    return;
  }
  try {
    await sound.stopAsync();
    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch (error) {
    console.log("Sound playback error:", error);
  }
};

export const releaseSounds = async () => {
  for (const sound of Object.values(sounds)) {
    await sound.unloadAsync();
  }
  sounds = {};
};