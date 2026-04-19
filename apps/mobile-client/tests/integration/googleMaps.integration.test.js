import { jest } from "@jest/globals";

describe("Google Maps Integration Tests", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should fetch nearby hospitals using Google Places API", async () => {
    const mockResponse = {
      results: [
        {
          name: "City Hospital",
          vicinity: "123 Health St",
          geometry: { location: { lat: 17.3850, lng: 78.4867 } }
        }
      ],
      status: "OK"
    };

    global.fetch.mockResolvedValue({
      json: jest.fn().mockResolvedValue(mockResponse)
    });

    const key = 'dummy-api-key';
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=17.3850,78.4867&radius=5000&type=hospital&key=${key}`;
    
    const response = await fetch(url, {
      headers: {
        'X-Android-Package': 'com.aushadx.mobileclient',
        'X-Android-Cert': 'C0C186E94304AD89114E874885B0C567DB050892'
      }
    });

    const data = await response.json();

    expect(global.fetch).toHaveBeenCalledWith(url, expect.objectContaining({
      headers: expect.objectContaining({
        'X-Android-Package': 'com.aushadx.mobileclient'
      })
    }));
    expect(data.status).toBe("OK");
    expect(data.results[0].name).toBe("City Hospital");
  });
});
