# Manages tenant profile CRUD against the Tenants Google Sheet.
class TenantService
  COLUMNS = %w[name email location wing flat contact password].freeze

  # Column letter mapping for editable fields.
  # Only location/wing/flat are tenant-editable; name/email/contact/password are read-only.
  EDITABLE_COLUMN_LETTERS = { 'location' => 'C', 'wing' => 'D', 'flat' => 'E' }.freeze

  def self.read_tenants
    response = GoogleService.sheets.get_spreadsheet_values(
      GoogleService::SHEET_ID, 'Tenants!A2:G'
    )

    (response.values || []).map do |row|
      tenant = {}
      COLUMNS.each_with_index { |col, i| tenant[col] = row[i].to_s }
      tenant
    end
  end

  def self.find_tenant(email)
    read_tenants.find { |t| t['email'].downcase == email.downcase }
  end

  # Returns both the row index and tenant data in a single read,
  # avoiding the double-read that would happen if find_tenant and
  # find_row_index were called separately.
  def self.find_tenant_with_index(email)
    tenants = read_tenants
    idx = tenants.find_index { |t| t['email'].downcase == email.downcase }
    return nil unless idx

    { index: idx, tenant: tenants[idx] }
  end

  # Batch-updates the editable fields and returns the updated tenant
  # without re-reading from the sheet.
  def self.update_tenant_fields(email, updates)
    result = find_tenant_with_index(email)
    raise 'Tenant not found' unless result

    row_num = result[:index] + 2
    tenant  = result[:tenant]

    batch_data = updates.filter_map do |field, value|
      col_letter = EDITABLE_COLUMN_LETTERS[field]
      next unless col_letter

      tenant[field] = value # Update in-memory copy
      Google::Apis::SheetsV4::ValueRange.new(
        range: "Tenants!#{col_letter}#{row_num}", values: [[value]]
      )
    end

    if batch_data.any?
      batch_req = Google::Apis::SheetsV4::BatchUpdateValuesRequest.new(
        value_input_option: 'RAW', data: batch_data
      )
      GoogleService.sheets.batch_update_values(GoogleService::SHEET_ID, batch_req)
    end

    tenant.delete('password')
    tenant
  end
end
