export const motionTransition = {
  quick: { duration: 0.14, ease: [0.22, 1, 0.36, 1] as const },
  standard: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const },
  layout: { type: 'spring' as const, stiffness: 420, damping: 38, mass: 0.7 },
}

export const overlayMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

export const dialogMotion = {
  initial: { opacity: 0, scale: 0.97, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.98, y: 6 },
}

export const sheetMotion = {
  initial: { opacity: 0.7, y: '100%' },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0.7, y: '100%' },
}
