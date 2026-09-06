import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { supabase } from './supabase';

/**
 * The notification sound.
 *
 * Off by default and read from the teacher's profile, so the preference
 * follows the account rather than the handset. An app that makes noise without
 * being asked gets silenced at the OS level, and then none of its alerts land
 * — including the one about a role closing tomorrow.
 */

// A short data-URI chime rather than a bundled asset: it is 1.5 KB, it cannot
// 404, and it keeps the sound out of the asset pipeline entirely.
const CHIME =
  'data:audio/wav;base64,UklGRiQEAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAEAAA=';

let player: AudioPlayer | null = null;
let configured = false;

/**
 * Play the alert tone, if the teacher has asked for one.
 *
 * Never throws. A notification that fails to make a sound is a small
 * disappointment; a notification that crashes the screen because an audio
 * session could not be acquired is a bug, and audio is exactly the subsystem
 * that fails for reasons outside the app (a call in progress, a silent switch,
 * a device with no output route).
 */
export async function playNotificationSound(enabled: boolean): Promise<void> {
  if (!enabled) return;
  try {
    if (!configured) {
      // Do not take over the audio session: a teacher listening to the radio
      // should not have it stopped by a job alert.
      await setAudioModeAsync({ playsInSilentMode: false, shouldPlayInBackground: false });
      configured = true;
    }
    player ??= createAudioPlayer({ uri: CHIME });
    player.seekTo(0);
    player.play();
  } catch {
    // Deliberately silent — see above.
  }
}

/** Persist the preference. It lives on the profile so it follows the account. */
export async function setNotificationSound(teacherId: string, on: boolean): Promise<void> {
  const { error } = await supabase
    .from('profiles').update({ notification_sound: on }).eq('id', teacherId);
  if (error !== null) throw new Error(error.message);
}
