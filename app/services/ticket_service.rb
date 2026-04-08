# Reads and writes ticket data in the Tickets Google Sheet.
#
# Each ticket occupies one row with columns A–P. The COLUMNS constant maps
# column names to their positions; all cell ↔ Ruby conversions happen here
# so controllers stay thin.
class TicketService
  COLUMNS = %w[
    id type desc status urgency urgencyOverridden triageReason time
    tenantEmail tenantName location wing flat contact locationEdited attachments
  ].freeze

  def self.read_tickets
    response = GoogleService.sheets.get_spreadsheet_values(
      GoogleService::SHEET_ID, 'Tickets!A2:P'
    )

    (response.values || []).map { |row| parse_row(row) }
  end

  def self.append_ticket(ticket)
    row = COLUMNS.map do |col|
      col == 'attachments' ? SheetSerializer.serialize_attachments(ticket[col] || []) : ticket[col].to_s
    end

    value_range = Google::Apis::SheetsV4::ValueRange.new(values: [row])
    GoogleService.sheets.append_spreadsheet_value(
      GoogleService::SHEET_ID,
      'Tickets!A:P',
      value_range,
      value_input_option: 'RAW'
    )
  end

  # Writes a single cell value for a given ticket.
  # Column letter is computed from the column name's position in COLUMNS
  # using ASCII arithmetic: 65 = 'A', so index 0 → 'A', index 3 → 'D'.
  def self.update_ticket_cell(ticket_id, col_name, value)
    row_num   = find_row_number(ticket_id)
    col_index = COLUMNS.index(col_name)
    raise "Unknown column: #{col_name}" unless col_index

    col_letter  = (65 + col_index).chr # ASCII 'A' + offset
    range       = "Tickets!#{col_letter}#{row_num}"
    value_range = Google::Apis::SheetsV4::ValueRange.new(values: [[value.to_s]])

    GoogleService.sheets.update_spreadsheet_value(
      GoogleService::SHEET_ID, range, value_range, value_input_option: 'RAW'
    )
  end

  # Batch-updates urgency AND urgencyOverridden in a single API call
  # (previously required 4 API calls: 2 reads + 2 writes).
  def self.update_urgency(ticket_id, urgency)
    row_num = find_row_number(ticket_id)

    urgency_col  = (65 + COLUMNS.index('urgency')).chr
    override_col = (65 + COLUMNS.index('urgencyOverridden')).chr

    batch_data = [
      Google::Apis::SheetsV4::ValueRange.new(
        range: "Tickets!#{urgency_col}#{row_num}", values: [[urgency]]
      ),
      Google::Apis::SheetsV4::ValueRange.new(
        range: "Tickets!#{override_col}#{row_num}", values: [['true']]
      )
    ]

    batch_req = Google::Apis::SheetsV4::BatchUpdateValuesRequest.new(
      value_input_option: 'RAW', data: batch_data
    )
    GoogleService.sheets.batch_update_values(GoogleService::SHEET_ID, batch_req)
  end

  # Generates the next sequential ticket ID (e.g., "TK-00101" after "TK-00100").
  def self.next_ticket_id
    response = GoogleService.sheets.get_spreadsheet_values(
      GoogleService::SHEET_ID, 'Tickets!A2:A'
    )

    max_num = 100
    (response.values || []).each do |row|
      num = row[0].to_s.sub('TK-', '').to_i
      max_num = num if num > max_num
    end

    "TK-#{(max_num + 1).to_s.rjust(5, '0')}"
  end

  # --- Private helpers ---

  # Reads only column A (ticket IDs) to locate a row without fetching all 16 columns.
  def self.find_row_number(ticket_id)
    response = GoogleService.sheets.get_spreadsheet_values(
      GoogleService::SHEET_ID, 'Tickets!A2:A'
    )
    rows = response.values || []
    idx = rows.find_index { |row| row[0] == ticket_id }
    raise "Ticket not found: #{ticket_id}" unless idx

    idx + 2 # +1 for 0-based index, +1 for header row
  end

  def self.parse_row(row)
    ticket = {}
    COLUMNS.each_with_index { |col, i| ticket[col] = row[i].to_s }

    ticket['urgencyOverridden'] = ticket['urgencyOverridden'] == 'true'
    ticket['locationEdited']    = ticket['locationEdited'] == 'true'
    ticket['attachments']       = SheetSerializer.parse_attachments(ticket['attachments'])

    ticket
  end

  private_class_method :find_row_number, :parse_row
end
