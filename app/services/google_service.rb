require 'google/apis/sheets_v4'
require 'google/apis/drive_v3'
require 'googleauth'
require 'base64'

# Centralized access to Google Sheets and Drive APIs.
#
# Uses memoized service instances (@sheets, @drive) to avoid re-authenticating
# on every request — the OAuth2 token is fetched once and reused until it expires.
class GoogleService
  SHEET_ID         = ENV['GOOGLE_SHEET_ID']
  CREDENTIALS_PATH = ENV['GOOGLE_CREDENTIALS_PATH'] || './credentials.json'
  DRIVE_FOLDER_ID  = ENV['GOOGLE_DRIVE_FOLDER_ID']

  def self.sheets
    @sheets ||= build_service(
      Google::Apis::SheetsV4::SheetsService,
      'https://www.googleapis.com/auth/spreadsheets'
    )
  end

  def self.drive
    @drive ||= build_service(
      Google::Apis::DriveV3::DriveService,
      'https://www.googleapis.com/auth/drive.file'
    )
  end

  # Builds a Google API service with the correct credentials.
  # Supports two credential sources:
  #   1. GOOGLE_CREDENTIALS_JSON env var (Base64-encoded) — used in production
  #   2. Local credentials.json file — used in development
  def self.build_service(service_class, scope)
    service = service_class.new
    service.authorization = Google::Auth::ServiceAccountCredentials.make_creds(
      json_key_io: credentials_io,
      scope: [scope]
    )
    service
  end

  def self.credentials_io
    if ENV['GOOGLE_CREDENTIALS_JSON'].present?
      StringIO.new(Base64.decode64(ENV['GOOGLE_CREDENTIALS_JSON']))
    else
      File.open(CREDENTIALS_PATH)
    end
  end

  private_class_method :build_service, :credentials_io
end
