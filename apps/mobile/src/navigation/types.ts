export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type VenuesStackParamList = {
  VenueList: undefined;
  VenueDetail: { venueId: string; venueName: string };
  CourtSlots: { courtId: string; courtName: string; venueName: string };
  BookingConfirm: {
    courtId: string;
    courtName: string;
    venueName: string;
    bookingDate: string;
    startTime: string;
    endTime: string;
    price: number;
  };
};

export type RootTabParamList = {
  Venues: undefined;
  MyBookings: undefined;
  Notifications: undefined;
  Account: undefined;
};
