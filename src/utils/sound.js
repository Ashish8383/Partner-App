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
  } catch (error) {
  }
};

export const playSound = async (key) => {
  const sound = sounds[key];
  if (!sound) {
    return;
  }
  try {
    await sound.stopAsync();
    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch (error) {
  }
};

export const releaseSounds = async () => {
  for (const sound of Object.values(sounds)) {
    await sound.unloadAsync();
  }
  sounds = {};
};