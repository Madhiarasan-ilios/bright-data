from twilio.rest import Client
import os

# Load credentials from environment variables
ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")
SERVICE_SID = os.environ.get("TWILIO_SERVICE_SID", "")

client = Client(ACCOUNT_SID, AUTH_TOKEN)


def main():
    email = input("Enter your email: ").strip()

    # STEP 1: Send OTP
    try:
        verification = client.verify.v2.services(SERVICE_SID) \
            .verifications \
            .create(
                to=email,
                channel="email"
            )

        print("OTP sent. Status:", verification.status)

    except Exception as e:
        print("Error sending OTP:", e)
        return

    # STEP 2: Enter OTP
    code = input("Enter OTP: ").strip()

    # STEP 3: Verify OTP
    try:
        result = client.verify.v2.services(SERVICE_SID) \
            .verification_checks \
            .create(
                to=email,
                code=code
            )

        print("Verification Status:", result.status)

        if result.status == "approved":
            print("✅ SUCCESS")
        else:
            print("❌ FAILED")

    except Exception as e:
        print("Error verifying OTP:", e)


if __name__ == "__main__":
    main()
