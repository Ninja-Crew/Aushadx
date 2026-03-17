export default ({ config }) => {
  return {
    ...config,
    android: {
      ...config.android,
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON || './google-services.json',
    },
    extra: {
      ...config.extra,
      googleMapsCert: process.env.GOOGLE_MAPS_CERT,
    },
  };
};
