import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { RequestOtpScreen } from "../screens/RequestOtpScreen";
import { FlowersListScreen } from "../screens/FlowersListScreen";

jest.mock("../auth/AuthContext", () => ({
  useAuth: jest.fn()
}));

jest.mock("../flowers/FlowersContext", () => ({
  useFlowers: jest.fn()
}));

jest.mock("../hooks/useAuthGuard", () => ({
  useAuthGuard: jest.fn(() => ({ email: "dev@example.com" }))
}));

const { useAuth } = jest.requireMock("../auth/AuthContext") as {
  useAuth: jest.Mock;
};
const { useFlowers } = jest.requireMock("../flowers/FlowersContext") as {
  useFlowers: jest.Mock;
};

describe("mobile smoke", () => {
  it("submits request OTP and navigates", async () => {
    const requestOtpForEmail = jest.fn().mockResolvedValue(true);
    const navigate = jest.fn();

    useAuth.mockReturnValue({
      busy: false,
      requestOtpForEmail
    });

    const screen = render(
      <RequestOtpScreen
        navigation={{ navigate } as never}
        route={{ key: "RequestOtp", name: "RequestOtp" } as never}
      />
    );

    fireEvent.changeText(screen.getByPlaceholderText("you@example.com"), "user@example.com");
    fireEvent.press(screen.getByText("Send OTP"));

    await waitFor(() => expect(requestOtpForEmail).toHaveBeenCalledWith("user@example.com"));
    expect(navigate).toHaveBeenCalledWith("VerifyOtp");
  });

  it("renders flowers list and handles refresh", async () => {
    const loadFlowers = jest.fn().mockResolvedValue(undefined);
    const navigate = jest.fn();

    useFlowers.mockReturnValue({
      flowers: [
        {
          id: 1,
          owner_id: 2,
          title: "Morning Bloom",
          flower_type: "rose",
          status: "growing",
          stage: 0,
          water_count: 2,
          streak_count: 2,
          ready_at: null,
          sent_at: null,
          created_at: new Date().toISOString()
        }
      ],
      loading: false,
      refreshing: false,
      error: null,
      loadFlowers
    });

    const screen = render(
      <FlowersListScreen
        navigation={{ navigate } as never}
        route={{ key: "FlowersList", name: "FlowersList" } as never}
      />
    );

    expect(screen.getByText("Morning Bloom")).toBeTruthy();
    fireEvent.press(screen.getByText("Create"));
    expect(navigate).toHaveBeenCalledWith("CreateFlower");
  });
});
