import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

export function navigate(name, params) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  }
}

export function replace(name, params) {
    if (navigationRef.isReady()) {
        // Reset the root state to the new route
        navigationRef.reset({
            index: 0,
            routes: [{ name, params }],
        });
    }
}
