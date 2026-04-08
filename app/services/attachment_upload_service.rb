require 'fileutils'

# Handles file upload to either Google Drive or local disk.
#
# Extracted from TicketsController because upload logic is an independent
# concern — the controller should only coordinate request → response,
# not manage file I/O details.
class AttachmentUploadService
  MAX_FILE_SIZE = 10.megabytes

  # Attempts Drive upload first; falls back to local storage if Drive is
  # unavailable or the upload fails.
  def self.upload(file)
    if GoogleService::DRIVE_FOLDER_ID.present?
      upload_to_drive(file)
    else
      save_locally(file)
    end
  rescue Google::Apis::Error => drive_error
    Rails.logger.error("Drive upload failed, falling back to local: #{drive_error.message}")
    save_locally(file)
  end

  # Uploads to Google Drive, makes the file publicly readable, and returns
  # a metadata hash with a prefixed ID for later retrieval.
  def self.upload_to_drive(file)
    unique_name = "#{SecureRandom.uuid}-#{file.original_filename}"

    metadata = { name: unique_name, parents: [GoogleService::DRIVE_FOLDER_ID] }

    response = GoogleService.drive.create_file(
      metadata,
      upload_source: file.tempfile.path,
      content_type:  file.content_type,
      fields:        'id,name,mimeType'
    )

    permission = Google::Apis::DriveV3::Permission.new(role: 'reader', type: 'anyone')
    GoogleService.drive.create_permission(response.id, permission)

    { 'id' => "drv_#{response.id}", 'name' => file.original_filename, 'mimeType' => file.content_type }
  end

  # Saves to the local uploads directory with a UUID-prefixed filename
  # to prevent collisions.
  def self.save_locally(file)
    uploads_dir = Rails.root.join('public', 'uploads')
    FileUtils.mkdir_p(uploads_dir)

    filename = "#{SecureRandom.uuid}#{File.extname(file.original_filename)}"
    File.open(uploads_dir.join(filename), 'wb') { |f| f.write(file.read) }

    { 'id' => "loc_#{filename}", 'name' => file.original_filename }
  end

  private_class_method :upload_to_drive, :save_locally
end
