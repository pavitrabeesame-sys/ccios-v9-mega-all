export interface BannerSpecDTO {
  brandName: string;
  campaignEvent: string;
  discountText: string;
  targetRatio: '1:1' | '16:9' | '9:16';
  primaryProductImageUrls: string[];
}

export interface BannerAssetResult {
  assetId: string;
  renderConfig: {
    dimensions: { width: number; height: number };
    layers: Array<{
      type: 'text' | 'image' | 'shape';
      content?: string;
      position: { x: number; y: number; zIndex: number };
      style?: Record<string, any>;
    }>;
  };
}

export class BannerAssetService {
  public generateBannerConfig(spec: BannerSpecDTO): BannerAssetResult {
    const dimensions = this.resolveDimensions(spec.targetRatio);

    return {
      assetId: `asset_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      renderConfig: {
        dimensions,
        layers: [
          {
            type: 'shape',
            position: { x: 0, y: 0, zIndex: 0 },
            style: { background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', width: '100%', height: '100%' },
          },
          {
            type: 'text',
            content: spec.brandName.toUpperCase(),
            position: { x: 40, y: 40, zIndex: 10 },
            style: { fontSize: 24, fontWeight: 'bold', color: '#94a3b8' },
          },
          {
            type: 'text',
            content: spec.campaignEvent,
            position: { x: 40, y: 80, zIndex: 10 },
            style: { fontSize: 48, fontWeight: '900', color: '#ffffff' },
          },
          {
            type: 'text',
            content: spec.discountText,
            position: { x: 40, y: 140, zIndex: 10 },
            style: { fontSize: 32, fontWeight: 'bold', color: '#ef4444' },
          },
          ...(spec.primaryProductImageUrls[0]
            ? [
                {
                  type: 'image' as const,
                  content: spec.primaryProductImageUrls[0],
                  position: { x: dimensions.width - 300, y: 50, zIndex: 5 },
                  style: { width: 250, height: 250, objectFit: 'contain' },
                },
              ]
            : []),
        ],
      },
    };
  }

  private resolveDimensions(ratio: '1:1' | '16:9' | '9:16'): { width: number; height: number } {
    switch (ratio) {
      case '1:1':
        return { width: 1080, height: 1080 };
      case '16:9':
        return { width: 1920, height: 1080 };
      case '9:16':
        return { width: 1080, height: 1920 };
    }
  }
}
