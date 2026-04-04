class TenantService
  TENANT_COLS = %w[name email location wing flat contact password]

  def self.read_tenants
    response = GoogleService.sheets.get_spreadsheet_values(GoogleService::SHEET_ID, 'Tenants!A2:G')
    (response.values || []).map do |row|
      tenant = {}
      TENANT_COLS.each_with_index do |col, i|
        tenant[col] = row[i].to_s
      end
      tenant
    end
  end

  def self.find_tenant(email)
    read_tenants.find { |t| t['email'].downcase == email.downcase }
  end

  def self.find_tenant_row_index(email)
    read_tenants.find_index { |t| t['email'].downcase == email.downcase }
  end

  def self.update_tenant_fields(email, updates)
    idx = find_tenant_row_index(email)
    raise 'Tenant not found' unless idx
    
    row_num = idx + 2
    col_map = { 'location' => 'C', 'wing' => 'D', 'flat' => 'E' }
    
    updates.each do |field, value|
      next unless col_map[field]
      
      value_range = Google::Apis::SheetsV4::ValueRange.new(values: [[value]])
      range = "Tenants!#{col_map[field]}#{row_num}"
      
      GoogleService.sheets.update_spreadsheet_value(
        GoogleService::SHEET_ID,
        range,
        value_range,
        value_input_option: 'RAW'
      )
    end
  end
end
