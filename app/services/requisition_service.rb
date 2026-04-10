# Manages manager requisition CRUD against the ManagerRequisitions sheet.
#
# Requisitions track the procurement/assessment process for each ticket:
# survey status, vendor selection, cost breakdown, and admin approval.
class RequisitionService
  COLUMNS = %w[
    ticket_id surveyed in_house_fix vendor_name est_cost
    cost_breakdown invoices admin_approval submitted_at admin_remarks
    vendor_confirmed vendor_confirmed_at vendor_confirmed_by vendor_proof
  ].freeze

  def self.read_requisitions
    response = GoogleService.sheets.get_spreadsheet_values(
      GoogleService::SHEET_ID, 'ManagerRequisitions!A2:N'
    )

    (response.values || []).map { |row| parse_row(row) }
  end

  def self.create_requisition(data)
    row = COLUMNS.map do |col|
      col == 'invoices' ? SheetSerializer.serialize_attachments(data[col] || []) : data[col].to_s
    end

    value_range = Google::Apis::SheetsV4::ValueRange.new(values: [row])
    GoogleService.sheets.append_spreadsheet_value(
      GoogleService::SHEET_ID,
      'ManagerRequisitions!A:N',
      value_range,
      value_input_option: 'RAW'
    )
  end

  def self.confirm_vendor(ticket_id, manager_name, confirmed_at, proof_attachment)
    row_num = find_row_number(ticket_id)

    batch_data = [
      Google::Apis::SheetsV4::ValueRange.new(
        range: "ManagerRequisitions!K#{row_num}", values: [['true']]
      ),
      Google::Apis::SheetsV4::ValueRange.new(
        range: "ManagerRequisitions!L#{row_num}", values: [[confirmed_at]]
      ),
      Google::Apis::SheetsV4::ValueRange.new(
        range: "ManagerRequisitions!M#{row_num}", values: [[manager_name]]
      ),
      Google::Apis::SheetsV4::ValueRange.new(
        range: "ManagerRequisitions!N#{row_num}", values: [[[ proof_attachment ].to_json]]
      )
    ]

    batch_req = Google::Apis::SheetsV4::BatchUpdateValuesRequest.new(
      value_input_option: 'RAW', data: batch_data
    )
    GoogleService.sheets.batch_update_values(GoogleService::SHEET_ID, batch_req)
  end

  def self.approve_requisition(ticket_id, remarks = '')
    update_approval_status(ticket_id, 'Approved', remarks)
  end

  def self.reject_requisition(ticket_id, remarks = '')
    update_approval_status(ticket_id, 'Rejected', remarks)
  end

  # --- Private helpers ---

  # Shared logic for approve/reject — they only differ in the status string.
  def self.update_approval_status(ticket_id, status, remarks)
    row_num = find_row_number(ticket_id)

    batch_data = [
      Google::Apis::SheetsV4::ValueRange.new(
        range: "ManagerRequisitions!H#{row_num}", values: [[status]]
      ),
      Google::Apis::SheetsV4::ValueRange.new(
        range: "ManagerRequisitions!J#{row_num}", values: [[remarks]]
      )
    ]

    batch_req = Google::Apis::SheetsV4::BatchUpdateValuesRequest.new(
      value_input_option: 'RAW', data: batch_data
    )
    GoogleService.sheets.batch_update_values(GoogleService::SHEET_ID, batch_req)
  end

  # Reads only column A to find the row number — avoids fetching unnecessary data.
  def self.find_row_number(ticket_id)
    response = GoogleService.sheets.get_spreadsheet_values(
      GoogleService::SHEET_ID, 'ManagerRequisitions!A2:A'
    )
    rows = response.values || []
    idx = rows.find_index { |row| row[0] == ticket_id }
    raise "Requisition not found for ticket: #{ticket_id}" unless idx

    idx + 2 # +1 for 0-based index, +1 for header row
  end

  def self.parse_row(row)
    req = {}
    COLUMNS.each_with_index { |col, i| req[col] = row[i].to_s }

    req['surveyed']          = req['surveyed'] == 'true'
    req['in_house_fix']      = req['in_house_fix'] == 'true'
    req['est_cost']          = req['est_cost'].to_f
    req['invoices']          = SheetSerializer.parse_attachments(req['invoices'])
    req['vendor_confirmed']  = req['vendor_confirmed'] == 'true'
    req['vendor_proof']      = SheetSerializer.parse_attachments(req['vendor_proof'])

    req
  end

  private_class_method :update_approval_status, :find_row_number, :parse_row

end
