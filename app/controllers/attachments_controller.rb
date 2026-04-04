class AttachmentsController < ApplicationController
  def show
    id = params[:id]

    if id.start_with?('drv_')
      drive_id = id.sub('drv_', '')
      
      begin
        meta = GoogleService.drive.get_file(drive_id, fields: 'mimeType')
        
        Tempfile.create(['drive_file', '']) do |tempfile|
          GoogleService.drive.get_file(drive_id, download_dest: tempfile.path)
          send_file tempfile.path, type: meta.mime_type, disposition: 'inline'
        end
      rescue => e
        render json: { error: 'Attachment not found in Drive' }, status: :not_found
      end
      
    elsif id.start_with?('loc_')
      filename = id.sub('loc_', '')
      uploads_dir = Rails.root.join('public', 'uploads').to_s
      file_path = File.expand_path(File.join(uploads_dir, filename))
      
      if file_path.start_with?(uploads_dir) && File.exist?(file_path)
        send_file file_path, disposition: 'inline'
      else
        render json: { error: 'Access denied or file not found' }, status: :forbidden
      end
    else
      render json: { error: 'Invalid attachment ID' }, status: :bad_request
    end
  end
end
