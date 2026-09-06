export type RemotePlayer = {
  id: string;
  name: string;
  position: [number, number, number];
  rotation: number;
  moving: boolean;
  height?: number;
};
