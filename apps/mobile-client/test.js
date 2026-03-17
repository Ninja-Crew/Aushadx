const key = 'AIzaSyD8HCvRVMc3G_9fdrN6u636rVRLE2rHdnE';
const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=17.3850,78.4867&radius=5000&type=hospital&key=${key}`;
fetch(url, {
  headers: {
    'X-Android-Package': 'com.aushadx.mobileclient',
    'X-Android-Cert': 'C0C186E94304AD89114E874885B0C567DB050892'
  }
}).then(res => res.json()).then(console.log).catch(console.error);
