import { useEffect, useState } from 'react';
import * as THREE from 'three';

export function AdCreative({ url, w, h, z = 0.125 }: { url: string; w: number; h: number; z?: number }) {
  const [creative, setCreative] = useState<{ texture: THREE.Texture; blurTexture: THREE.Texture; aspect: number } | null>(null);

  useEffect(() => {
    let alive = true;
    const loader = new THREE.TextureLoader();

    loader.load(url, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;

      const image: any = texture.image;
      const aspect = image?.width && image?.height ? image.width / image.height : 1;
      const canvas = document.createElement('canvas');
      canvas.width = 768;
      canvas.height = 768;
      const ctx = canvas.getContext('2d');
      let blurTexture: THREE.Texture;

      if (ctx && image?.width && image?.height) {
        const canvasAspect = canvas.width / canvas.height;
        const imageAspect = image.width / image.height;
        let dw: number, dh: number;
        if (imageAspect > canvasAspect) {
          dh = canvas.height * 1.12;
          dw = dh * imageAspect;
        } else {
          dw = canvas.width * 1.12;
          dh = dw / imageAspect;
        }
        ctx.fillStyle = '#080d14';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.filter = 'blur(26px) brightness(0.55)';
        ctx.drawImage(image, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
        ctx.restore();
        blurTexture = new THREE.CanvasTexture(canvas);
        blurTexture.colorSpace = THREE.SRGBColorSpace;
        blurTexture.minFilter = THREE.LinearFilter;
        blurTexture.magFilter = THREE.LinearFilter;
      } else {
        blurTexture = texture.clone();
        blurTexture.needsUpdate = true;
      }

      if (alive) setCreative({ texture, blurTexture, aspect });
      else {
        texture.dispose();
        blurTexture.dispose();
      }
    }, undefined, () => alive && setCreative(null));

    return () => {
      alive = false;
      setCreative((prev) => {
        if (prev) {
          prev.texture.dispose();
          if (prev.blurTexture !== prev.texture) prev.blurTexture.dispose();
        }
        return null;
      });
    };
  }, [url]);

  if (!creative) {
    return <mesh position={[0, 0, z]}><planeGeometry args={[w, h]} /><meshBasicMaterial color="#0b1018" toneMapped={false} /></mesh>;
  }

  const boardAspect = w / h;
  const imageW = creative.aspect >= boardAspect ? w : h * creative.aspect;
  const imageH = creative.aspect >= boardAspect ? w / creative.aspect : h;

  return <group position={[0, 0, z]}>
    <mesh><planeGeometry args={[w, h]} /><meshBasicMaterial map={creative.blurTexture} toneMapped={false} side={THREE.DoubleSide} /></mesh>
    <mesh position={[0, 0, 0.002]}><planeGeometry args={[w, h]} /><meshBasicMaterial color="#05080d" transparent opacity={0.18} toneMapped={false} side={THREE.DoubleSide} /></mesh>
    <mesh position={[0, 0, 0.004]}><planeGeometry args={[imageW, imageH]} /><meshBasicMaterial map={creative.texture} toneMapped={false} side={THREE.DoubleSide} /></mesh>
  </group>;
}
