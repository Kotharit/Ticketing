require 'uuidtools'
require 'fileutils'

class TicketsController < ApplicationController
  def index
    tickets = TicketService.read_tickets
    if params[:email].present?
      tickets = tickets.select { |t| t['tenantEmail'] == params[:email] }
    end
    render json: tickets
  rescue => e
    render json: { error: 'Failed to read tickets' }, status: :internal_server_error
  end

  def create
    type = params[:type]
    desc = params[:desc]
    tenant_email = params[:tenantEmail]

    if type.blank? || desc.blank? || tenant_email.blank?
      return render json: { error: 'Missing required fields' }, status: :bad_request
    end

    tenant = TenantService.find_tenant(tenant_email)
    return render json: { error: 'Tenant not found' }, status: :not_found unless tenant

    id = TicketService.get_next_ticket_id
    now = Time.now
    time_str = now.strftime("%d %b at %H:%M")

    triage = TriageService.smart_triage(type, desc)

    attachments = []
    
    if params[:attachments].present?
      file_array = params[:attachments].is_a?(Array) ? params[:attachments] : [params[:attachments]]
      
      file_array.each do |file|
        begin
          if GoogleService::DRIVE_FOLDER_ID.present?
            begin
              att = upload_to_drive(file)
              attachments << att
            rescue => drive_err
              Rails.logger.error "Drive upload failed: #{drive_err.message}"
              attachments << save_locally(file)
            end
          else
            attachments << save_locally(file)
          end
        rescue => e
          Rails.logger.error "Upload error for #{file.original_filename}: #{e.message}"
        end
      end
    end

    ticket = {
      'id' => id,
      'type' => type,
      'desc' => desc,
      'status' => 'open',
      'urgency' => triage[:level],
      'urgencyOverridden' => false,
      'triageReason' => triage[:reason],
      'time' => time_str,
      'tenantEmail' => tenant['email'],
      'tenantName' => tenant['name'],
      'location' => tenant['location'],
      'wing' => tenant['wing'],
      'flat' => tenant['flat'],
      'contact' => tenant['contact'],
      'locationEdited' => params[:locationEdited] == 'true',
      'attachments' => attachments
    }

    TicketService.append_ticket(ticket)
    render json: ticket
  rescue => e
    Rails.logger.error "Create ticket error: #{e.message}"
    render json: { error: 'Failed to create ticket' }, status: :internal_server_error
  end

  def update_status
    TicketService.update_ticket_cell(params[:id], 'status', params[:status])
    render json: { success: true }
  rescue => e
    render json: { error: e.message }, status: :internal_server_error
  end

  def update_urgency
    TicketService.update_ticket_cell(params[:id], 'urgency', params[:urgency])
    TicketService.update_ticket_cell(params[:id], 'urgencyOverridden', true)
    render json: { success: true }
  rescue => e
    render json: { error: e.message }, status: :internal_server_error
  end

  private

  def upload_to_drive(file)
    original_name = file.original_filename
    unique_name = "#{SecureRandom.uuid}-#{original_name}"
    
    file_metadata = {
      name: unique_name,
      parents: [GoogleService::DRIVE_FOLDER_ID]
    }
    
    response = GoogleService.drive.create_file(
      file_metadata,
      upload_source: file.tempfile.path,
      content_type: file.content_type,
      fields: 'id,name,mimeType'
    )
    
    GoogleService.drive.create_permission(response.id, Google::Apis::DriveV3::Permission.new(role: 'reader', type: 'anyone'))
    
    { 'id' => "drv_#{response.id}", 'name' => original_name, 'mimeType' => file.content_type }
  end

  def save_locally(file)
    uploads_dir = Rails.root.join('public', 'uploads')
    FileUtils.mkdir_p(uploads_dir)
    
    filename = "#{SecureRandom.uuid}#{File.extname(file.original_filename)}"
    File.open(uploads_dir.join(filename), 'wb') do |f|
      f.write(file.read)
    end
    
    { 'id' => "loc_#{filename}", 'name' => file.original_filename }
  end
end
