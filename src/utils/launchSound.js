// Start once per document load, independently of React screen changes.
// Browsers that block audible autoplay get a first-interaction fallback.
export function playLaunchSound(src) {
  const audio = new Audio(src);
  audio.preload = 'auto';
  audio.loop = false;
  let started = false;
  let pending = false;

  const removeListeners = () => {
    document.removeEventListener('click', onInteraction);
    document.removeEventListener('keydown', onInteraction);
  };
  function onInteraction(event) {
    if (event.isTrusted && !event.repeat) void play();
  }
  async function play() {
    if (started || pending) return;
    pending = true;
    try {
      await audio.play();
      started = true;
      removeListeners();
    } catch (error) {
      if (error.name === 'NotAllowedError') {
        document.addEventListener('click', onInteraction);
        document.addEventListener('keydown', onInteraction);
      } else {
        removeListeners(); // Missing/unsupported audio must not affect the invite.
      }
    } finally {
      pending = false;
    }
  }
  void play();
  return () => { started = true; removeListeners(); audio.pause(); };
}
