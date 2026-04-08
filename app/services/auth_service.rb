# Authenticates admin and manager users against Google Sheets.
#
# Both roles are stored in identically structured sheets (name | username | password),
# so `find_user_in_sheet` handles both — the public methods are thin wrappers
# that specify which sheet to query.
#
# NOTE: Passwords are stored and compared as plain text. This is acceptable for
# the current demo/prototype. For production, add bcrypt hashing.
class AuthService
  def self.find_admin(username)
    find_user_in_sheet('Admins', username)
  end

  def self.find_manager(username)
    find_user_in_sheet('Managers', username)
  end

  # Queries a sheet with columns [name, username, password] and returns
  # the matching row as a structured hash, or nil if not found.
  def self.find_user_in_sheet(sheet_name, username)
    response = GoogleService.sheets.get_spreadsheet_values(
      GoogleService::SHEET_ID, "#{sheet_name}!A2:C"
    )

    row = (response.values || []).find { |r| r[1]&.downcase == username.downcase }
    return nil unless row

    { name: row[0], username: row[1], password: row[2] }
  end

  private_class_method :find_user_in_sheet
end
