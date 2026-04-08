# Shared serialization logic for Google Sheets attachment columns.
#
# Both TicketService and RequisitionService store attachments as JSON in a cell,
# with a human-readable "---LINKS---" section appended so admins can click links
# directly in the spreadsheet. This module centralizes that encoding/decoding
# to eliminate duplication.
module SheetSerializer
  # Converts a cell string (JSON + optional link footer) back to a Ruby array.
  def self.parse_attachments(cell_value)
    raw = (cell_value || '').to_s

    # Strip the human-readable link footer if present
    raw = raw.split("\n\n---LINKS---\n").first if raw.include?("\n\n---LINKS---\n")

    JSON.parse(raw.presence || '[]')
  rescue JSON::ParserError
    []
  end

  # Converts a Ruby array of attachment hashes into the cell format:
  #   [JSON array]\n\n---LINKS---\n[clickable URLs]
  def self.serialize_attachments(attachments)
    return '[]' if attachments.blank?

    json_string = attachments.to_json
    links = attachments.map do |attachment|
      if attachment['id'].to_s.start_with?('drv_')
        drive_id = attachment['id'].sub('drv_', '')
        "https://drive.google.com/open?id=#{drive_id}"
      else
        attachment['name']
      end
    end

    "#{json_string}\n\n---LINKS---\n#{links.join("\n")}"
  end
end
