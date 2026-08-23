export const PHASE16_SEO_VERSION = "16.0.0";

export interface Phase16Manifest {
  readonly phase: 16;
  readonly timestamp: string;
  readonly pipeline_version: string;
  readonly seo_version: string;
  readonly total_public: number;
  readonly indexable_count: number;
  readonly indexable_rate: number;
  readonly sitemap_slugs: number;
  readonly collection_pages: number;
  readonly structured_data_types: readonly string[];
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}
