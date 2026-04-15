declare module "google-trends-api" {
  interface TrendsOptions {
    keyword: string | string[];
    geo?: string;
    property?: string;
    startTime?: Date;
    endTime?: Date;
    hl?: string;
  }
  const googleTrends: {
    interestOverTime: (opts: TrendsOptions) => Promise<string>;
    relatedQueries: (opts: TrendsOptions) => Promise<string>;
    relatedTopics: (opts: TrendsOptions) => Promise<string>;
    interestByRegion: (opts: TrendsOptions) => Promise<string>;
    dailyTrends: (opts: { geo: string; trendDate?: Date }) => Promise<string>;
    realTimeTrends: (opts: { geo: string; category?: string }) => Promise<string>;
  };
  export default googleTrends;
}
