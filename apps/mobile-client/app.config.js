export default ({ config }) => {
  return {
    ...config,
    android: {
      ...config.android,
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON || './google-services.json',
    },
    extra: {
      ...config.extra,
      googleMapsCert: process.env.GOOGLE_MAPS_CERT || 'C0C186E94304AD89114E874885B0C567DB050892',
    },
  };
};
