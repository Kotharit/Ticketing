# Rake tasks for Google Sheets setup and maintenance.
#
# Usage:
#   rake sheets:setup            — Creates required sheets and populates headers
#   rake sheets:fix_credentials  — Seeds demo admin/manager credentials

namespace :sheets do
  desc 'Create required Google Sheets tabs (Managers, Admins, ManagerRequisitions) and populate headers'
  task setup: :environment do
    spreadsheet     = GoogleService.sheets.get_spreadsheet(GoogleService::SHEET_ID)
    existing_sheets = spreadsheet.sheets.map { |s| s.properties.title }

    sheets_to_create = %w[Managers Admins ManagerRequisitions] - existing_sheets

    if sheets_to_create.any?
      requests = sheets_to_create.map { |name| { add_sheet: { properties: { title: name } } } }
      batch = Google::Apis::SheetsV4::BatchUpdateSpreadsheetRequest.new(requests: requests)
      GoogleService.sheets.batch_update_spreadsheet(GoogleService::SHEET_ID, batch)
      puts "Created sheets: #{sheets_to_create.join(', ')}"
    else
      puts 'All required sheets already exist.'
    end

    header_data = []

    unless existing_sheets.include?('Managers')
      header_data << Google::Apis::SheetsV4::ValueRange.new(
        range: 'Managers!A1:C2',
        values: [
          %w[name username password],
          ['Site Manager', 'manager', 'manager123']
        ]
      )
    end

    unless existing_sheets.include?('Admins')
      header_data << Google::Apis::SheetsV4::ValueRange.new(
        range: 'Admins!A1:C2',
        values: [
          %w[name username password],
          ['System Admin', 'admin', 'admin123']
        ]
      )
    end

    unless existing_sheets.include?('ManagerRequisitions')
      header_data << Google::Apis::SheetsV4::ValueRange.new(
        range: 'ManagerRequisitions!A1:J1',
        values: [RequisitionService::COLUMNS]
      )
    end

    if header_data.any?
      batch_values = Google::Apis::SheetsV4::BatchUpdateValuesRequest.new(
        value_input_option: 'RAW', data: header_data
      )
      GoogleService.sheets.batch_update_values(GoogleService::SHEET_ID, batch_values)
      puts 'Populated headers and demo credentials.'
    end

    puts 'Done!'
  end

  desc 'Reset admin and manager demo credentials'
  task fix_credentials: :environment do
    admin_data = Google::Apis::SheetsV4::ValueRange.new(
      values: [%w[name username password], ['System Admin', 'admin', 'admin123']]
    )
    GoogleService.sheets.update_spreadsheet_value(
      GoogleService::SHEET_ID, 'Admins!A1:C2', admin_data, value_input_option: 'RAW'
    )

    manager_data = Google::Apis::SheetsV4::ValueRange.new(
      values: [%w[name username password], ['Site Manager', 'manager', 'manager123']]
    )
    GoogleService.sheets.update_spreadsheet_value(
      GoogleService::SHEET_ID, 'Managers!A1:C2', manager_data, value_input_option: 'RAW'
    )

    puts 'Demo credentials reset.'
  end
end
