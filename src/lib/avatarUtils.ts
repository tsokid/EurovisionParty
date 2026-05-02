const GRADIENTS = [
  'from-pink-500 to-purple-600',
  'from-purple-500 to-indigo-600',
  'from-fuchsia-500 to-pink-600',
  'from-violet-500 to-purple-600',
  'from-rose-500 to-pink-600',
  'from-indigo-500 to-violet-600',
];

export function avatarGradient(index: number): string {
  return GRADIENTS[index % GRADIENTS.length];
}

export function avatarInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}
