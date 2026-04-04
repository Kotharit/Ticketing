class TicketService
  TICKET_COLS = %w[id type desc status urgency urgencyOverridden triageReason time tenantEmail tenantName location wing flat contact locationEdited attachments]

  def self.read_tickets
    response = GoogleService.sheets.get_spreadsheet_values(GoogleService::SHEET_ID, 'Tickets!A2:P')
    (response.values || []).map do |row|
      ticket = {}
      TICKET_COLS.each_with_index { |col, i| ticket[col] = row[i].to_s }
      ticket['urgencyOverridden'] = ticket['urgencyOverridden'] == 'true'
      ticket['locationEdited'] = ticket['locationEdited'] == 'true'
      
      att_str = ticket['attachments'] || ''
      att_str = att_str.split("\n\n---LINKS---\n").first if att_str.include?("\n\n---LINKS---\n")
      
      begin
        ticket['attachments'] = JSON.parse(att_str.presence || '[]')
      rescue JSON::ParserError
        ticket['attachments'] = []
      end
      ticket
    end
  end

  def self.append_ticket(ticket)
    row = TICKET_COLS.map do |c|
      if c == 'attachments'
        attachments = ticket[c] || []
        if attachments.empty?
          '[]'
        else
          json_string = attachments.to_json
          links = attachments.map { |a| a['id'].start_with?('drv_') ? "https://drive.google.com/open?id=#{a['id'].sub('drv_', '')}" : a['name'] }
          "#{json_string}\n\n---LINKS---\n#{links.join("\n")}"
        end
      elsif c == 'urgencyOverridden' || c == 'locationEdited'
        ticket[c].to_s
      else
        ticket[c].to_s
      end
    end

    value_range = Google::Apis::SheetsV4::ValueRange.new(values: [row])
    GoogleService.sheets.append_spreadsheet_value(
      GoogleService::SHEET_ID,
      'Tickets!A:P',
      value_range,
      value_input_option: 'RAW'
    )
  end

  def self.find_ticket_row_index(ticket_id)
    tickets = read_tickets
    tickets.find_index { |t| t['id'] == ticket_id }
  end

  def self.update_ticket_cell(ticket_id, col_name, value)
    idx = find_ticket_row_index(ticket_id)
    raise 'Ticket not found' unless idx
    row_num = idx + 2
    col_index = TICKET_COLS.index(col_name)
    raise 'Invalid column' unless col_index
    col_letter = (65 + col_index).chr

    value_range = Google::Apis::SheetsV4::ValueRange.new(values: [[value.to_s]])
    range = "Tickets!#{col_letter}#{row_num}"

    GoogleService.sheets.update_spreadsheet_value(
      GoogleService::SHEET_ID,
      range,
      value_range,
      value_input_option: 'RAW'
    )
  end

  def self.get_next_ticket_id
    response = GoogleService.sheets.get_spreadsheet_values(GoogleService::SHEET_ID, 'Tickets!A2:A')
    max = 100
    (response.values || []).each do |row|
      num = row[0].to_s.sub('TK-', '').to_i
      max = num if num > max
    end
    "TK-#{(max + 1).to_s.rjust(5, '0')}"
  end
end
