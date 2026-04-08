# Serves file attachments from either Google Drive or local uploads.
#
# Attachment IDs are prefixed to indicate their storage backend:
#   - "drv_<id>" → Google Drive file
#   - "loc_<filename>" → local public/uploads/ file
class AttachmentsController < ApplicationController
  def show
    attachment_id = params[:id].to_s

    if attachment_id.start_with?('drv_')
      serve_drive_attachment(attachment_id.sub('drv_', ''))
    elsif attachment_id.start_with?('loc_')
      serve_local_attachment(attachment_id.sub('loc_', ''))
    else
      render json: { error: 'Invalid attachment ID format' }, status: :bad_request
    end
  end

  private

  def serve_drive_attachment(drive_id)
    meta = GoogleService.drive.get_file(drive_id, fields: 'mimeType')

    # Stream into a StringIO buffer to avoid the Tempfile race condition
    # where the file is deleted before send_file finishes streaming.
    buffer = StringIO.new
    GoogleService.drive.get_file(drive_id, download_dest: buffer)
    buffer.rewind

    send_data buffer.read, type: meta.mime_type, disposition: 'inline'
  rescue Google::Apis::Error => e
    Rails.logger.error("Drive attachment fetch failed [#{drive_id}]: #{e.message}")
    render json: { error: 'Attachment not found in Drive' }, status: :not_found
  end

  def serve_local_attachment(filename)
    uploads_dir = Rails.root.join('public', 'uploads').to_s
    file_path   = File.expand_path(File.join(uploads_dir, filename))

    # Path traversal protection: ensure the resolved path stays within uploads/
    unless file_path.start_with?(uploads_dir) && File.exist?(file_path)
      render json: { error: 'Access denied or file not found' }, status: :forbidden
      return
    end

    send_file file_path, disposition: 'inline'
  end
end
