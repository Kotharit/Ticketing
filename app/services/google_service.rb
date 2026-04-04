require 'google/apis/sheets_v4'
require 'google/apis/drive_v3'
require 'googleauth'

class GoogleService
  SHEET_ID = ENV['GOOGLE_SHEET_ID']
  CREDENTIALS_PATH = ENV['GOOGLE_CREDENTIALS_PATH'] || './credentials.json'
  DRIVE_FOLDER_ID = ENV['GOOGLE_DRIVE_FOLDER_ID']

  def self.sheets
    @sheets ||= begin
      service = Google::Apis::SheetsV4::SheetsService.new
      service.authorization = Google::Auth::ServiceAccountCredentials.make_creds(
        json_key_io: File.open(CREDENTIALS_PATH),
        scope: ["https://www.googleapis.com/auth/spreadsheets"]
      )
      service
    end
  end

  def self.drive
    @drive ||= begin
      service = Google::Apis::DriveV3::DriveService.new
      service.authorization = Google::Auth::ServiceAccountCredentials.make_creds(
        json_key_io: File.open(CREDENTIALS_PATH),
        scope: ["https://www.googleapis.com/auth/drive.file"]
      )
      service
    end
  end
end
