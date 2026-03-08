import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, TouchableOpacity, Linking, Platform } from 'react-native';
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { useTheme } from '../context/ThemeContext';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Constants from 'expo-constants';

const GOOGLE_API_KEY = Constants.expoConfig?.extra?.googleMapsApiKey;

// Utility to calculate distance between two coordinates in km
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2-lat1); 
  var dLon = deg2rad(lon2-lon1); 
  var a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  var d = R * c; // Distance in km
  return d.toFixed(1);
}

function deg2rad(deg) {
  return deg * (Math.PI/180)
}

const NearbyHospitalsScreen = () => {

  
  const { colors, isDark } = useTheme();
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // New States for Interaction
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [placeDetails, setPlaceDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const fetchNearbyHospitals = async (lat, lng) => {
    const mockPlaces = [
      { id: '1', name: 'City Hospital', lat: lat + 0.01, lng: lng + 0.01, type: 'Hospital' },
      { id: '2', name: 'Green Valley Clinic', lat: lat - 0.01, lng: lng + 0.005, type: 'Clinic' },
      { id: '3', name: 'Downtown Pharmacy', lat: lat + 0.005, lng: lng - 0.01, type: 'Pharmacy' },
    ];

    // If no API key provided, show mock data around user
    if (!GOOGLE_API_KEY) {
      setPlaces(mockPlaces);
      setLoading(false);
      return;
    }

    try {
      const radius = 5000; // 5km
      const type = 'hospital';
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}&key=${GOOGLE_API_KEY}`;
      
      const response = await fetch(url, {
        headers: {
          'X-Android-Package': 'com.anonymous.mobileclient',
          'X-Android-Cert': 'C0C186E94304AD89114E874885B0C567DB050892'
        }
      });
      const data = await response.json();
      
      if (data.status === 'OK') {
        const formattedPlaces = data.results.map(place => ({
          id: place.place_id,
          name: place.name,
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng,
          type: place.vicinity || 'Hospital',
          rating: place.rating,
          user_ratings_total: place.user_ratings_total
        }));
        setPlaces(formattedPlaces);
      } else {
        console.warn('Google Places API Error:', data.status, data.error_message);
        Alert.alert('Google API Error', `${data.status}: ${data.error_message || 'No results found.'}\n\nFalling back to mock data.`);
        setPlaces(mockPlaces); // Fallback to map testing
      }
    } catch (error) {
      console.error('Fetch Nearby Hospitals Error:', error);
      Alert.alert('Error', 'Could not fetch nearby hospitals. Showing mock data.');
      setPlaces(mockPlaces);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlaceDetails = async (place) => {
    setSelectedPlace(place);
    
    // Setup Mock Details if no API Key
    if (!GOOGLE_API_KEY) {
       setPlaceDetails({
         formatted_address: '123 Mock Street, Fake City',
         formatted_phone_number: '555-0123',
         rating: 4.5,
         user_ratings_total: 120,
         opening_hours: { open_now: true }
       });
       return;
    }

    setLoadingDetails(true);
    try {
       const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.id}&fields=name,rating,formatted_phone_number,formatted_address,opening_hours,user_ratings_total&key=${GOOGLE_API_KEY}`;
       const response = await fetch(url, {
         headers: {
           'X-Android-Package': 'com.anonymous.mobileclient',
           'X-Android-Cert': 'C0C186E94304AD89114E874885B0C567DB050892'
         }
       });
       const data = await response.json();

       if (data.status === 'OK') {
         setPlaceDetails(data.result);
       } else {
         setPlaceDetails(null);
       }
    } catch (error) {
       console.error("Error fetching place details:", error);
       setPlaceDetails(null);
    } finally {
       setLoadingDetails(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setErrorMsg('Permission to access location was denied');
          setLoading(false);
          return;
        }

        let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });

        await fetchNearbyHospitals(loc.coords.latitude, loc.coords.longitude);
      } catch (err) {
        setErrorMsg('Failed to determine location: ' + err.message);
        setLoading(false);
      }
    })();
  }, []);

  const handleCall = () => {
    if (placeDetails?.formatted_phone_number) {
      Linking.openURL(`tel:${placeDetails.formatted_phone_number.replace(/\D/g,'')}`);
    } else {
      Alert.alert("No Phone Number", "A phone number is not available for this location.");
    }
  };

  const handleDirections = () => {
    if (!selectedPlace) return;
    const scheme = Platform.select({ ios: 'maps://0,0?q=', android: 'geo:0,0?q=' });
    const latLng = `${selectedPlace.lat},${selectedPlace.lng}`;
    const label = selectedPlace.name;
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`
    });
    Linking.openURL(url);
  };

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Finding nearby medical facilities...</Text>
      </View>
    );
  }

  if (errorMsg) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <MaterialIcons name="location-disabled" size={48} color={colors.error} />
        <Text style={[styles.errorText, { color: colors.error }]}>{errorMsg}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {location && (
        <MapView
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={location}
          showsUserLocation={true}
          showsMyLocationButton={true}
          zoomEnabled={true}
          scrollEnabled={true}
          pitchEnabled={true}
          rotateEnabled={true}
          onPress={(e) => {
            // Deselect when tapping on empty map
            if (e.nativeEvent.action !== 'marker-press') {
              setSelectedPlace(null);
              setPlaceDetails(null);
            }
          }}
          onPanDrag={() => {
            // Force deselection when user drags the map
            setSelectedPlace(null);
            setPlaceDetails(null);
          }}
        >
          {places.map((place) => {
            const isSelected = selectedPlace?.id === place.id;
            return (
              <Marker
                key={`${place.id}-${isSelected}`}
                coordinate={{ latitude: place.lat, longitude: place.lng }}
                pinColor={isSelected ? "blue" : "red"}
                opacity={1} // Keep at 1 to prevent Android native callout clipping bug
                zIndex={isSelected ? 10 : 1}
                onPress={(e) => {
                  e.stopPropagation();
                  fetchPlaceDetails(place);
                }}
              />
            );
          })}
        </MapView>
      )}

      {/* Header Info Block */}
      {!selectedPlace && (
        <View style={[styles.topBanner, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Text style={[styles.topBannerText, { color: colors.text }]}>
            Found {places.length} Nearby Hospitals
          </Text>
        </View>
      )}

      {/* Selected Place Details Card */}
      {selectedPlace && (
        <View style={[styles.bottomSheet, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderTopColor: colors.border }]}>
          
          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity 
              style={[
                styles.actionButton, 
                { backgroundColor: placeDetails?.formatted_phone_number ? '#4CAF50' : '#E0E0E0' }
              ]} 
              onPress={handleCall}
              disabled={!placeDetails?.formatted_phone_number}
            >
              <Text style={[styles.actionButtonText, !placeDetails?.formatted_phone_number && { color: '#9E9E9E' }]}>Call</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: colors.primary }]} 
              onPress={handleDirections}
            >
              <Text style={styles.actionButtonText}>Directions</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.actionButton, 
                { backgroundColor: '#E0E0E0' } // Disabled by default as placeholder
              ]} 
              disabled={true}
              onPress={() => Alert.alert("Booking", "Booking interface not yet implemented.")}
            >
              <Text style={[styles.actionButtonText, { color: '#9E9E9E' }]}>Book</Text>
            </TouchableOpacity>
          </View>

          {/* Details */}
          <View style={styles.detailsContainer}>
            <Text style={[styles.placeName, { color: colors.text }]} numberOfLines={1}>
              {selectedPlace.name}
            </Text>

            {loadingDetails ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 10 }} />
            ) : (
              <>
                <View style={styles.detailRow}>
                  <MaterialIcons name="location-on" size={16} color={colors.textSecondary} style={styles.detailIcon}/>
                  <Text style={[styles.detailText, { color: colors.textSecondary }]} numberOfLines={2}>
                    {placeDetails?.formatted_address || selectedPlace.type}
                  </Text>
                </View>

                {placeDetails?.formatted_phone_number && (
                  <View style={styles.detailRow}>
                    <MaterialIcons name="phone" size={16} color={colors.textSecondary} style={styles.detailIcon}/>
                    <Text style={[styles.detailText, { color: colors.textSecondary }]}>{placeDetails.formatted_phone_number}</Text>
                  </View>
                )}

                <View style={styles.detailRow}>
                  <MaterialIcons name="star" size={16} color="#FFC107" style={styles.detailIcon}/>
                  <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                    Rating: {placeDetails?.rating || selectedPlace.rating || 'N/A'}/5 
                    ({placeDetails?.user_ratings_total || selectedPlace.user_ratings_total || 0} reviews)
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <MaterialIcons name="straighten" size={16} color={colors.textSecondary} style={styles.detailIcon}/>
                  <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                    Distance: {getDistanceFromLatLonInKm(location?.latitude, location?.longitude, selectedPlace.lat, selectedPlace.lng)} km
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <MaterialIcons name="access-time" size={16} color={colors.textSecondary} style={styles.detailIcon}/>
                  <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                    {placeDetails?.opening_hours?.open_now ? 'Open now' : 'Closed or Unknown'}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>
      )}

      {/* Warning if no key */}
      {!GOOGLE_API_KEY && (
         <View style={styles.mockWarning}>
           <Text style={{ color: '#FF9500', fontSize: 10, textAlign: 'center' }}>* Displaying mock data (Missing Google API Key)</Text>
         </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 12, fontSize: 15, fontWeight: '500' },
  errorText: { marginTop: 12, fontSize: 15, textAlign: 'center' },
  map: { width: '100%', height: '100%' },
  
  topBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  topBannerText: { fontSize: 16, fontWeight: 'bold' },

  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40, // accommodate possible home gesture bar
    borderTopWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 10,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  detailsContainer: {
    paddingHorizontal: 4,
  },
  placeName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailIcon: {
    marginRight: 8,
    width: 20,
    textAlign: 'center',
  },
  detailText: {
    fontSize: 14,
    flex: 1,
  },

  mockWarning: {
    position: 'absolute',
    top: 50,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8
  }
});

export default NearbyHospitalsScreen;
