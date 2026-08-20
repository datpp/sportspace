export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

export type VenuesStackParamList = {
  VenueList: undefined;
  VenueDetail: { venueId: string; venueName: string };
  CourtSlots: { venueId: string; courtId: string; courtName: string; venueName: string };
  BookingConfirm: {
    venueId: string;
    courtId: string;
    courtName: string;
    venueName: string;
    bookingDate: string;
    startTime: string;
    endTime: string;
    price: number;
  };
};

export type MyBookingsStackParamList = {
  MyBookingsList: undefined;
  CreateMatch: {
    bookingId: string;
    courtName: string;
    bookingDate: string;
    startTime: string;
    endTime: string;
  };
  WriteReview: {
    bookingId: string;
    courtName: string;
  };
};

export type MatchesStackParamList = {
  MatchList: undefined;
  MatchDetail: { matchId: string };
};

export type RootTabParamList = {
  Venues: undefined;
  MyBookings: undefined;
  Matches: undefined;
  Notifications: undefined;
  Account: undefined;
};
