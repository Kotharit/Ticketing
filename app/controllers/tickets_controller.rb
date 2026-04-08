# Handles ticket creation, listing, and status/urgency updates.
#
# Ticket data flows:  Controller → TicketService → GoogleService → Google Sheets
# File uploads flow:  Controller → AttachmentUploadService → Drive or local disk
class TicketsController < ApplicationController
  def index
    tickets = TicketService.read_tickets

    if params[:email].present?
      tickets = tickets.select { |t| t['tenantEmail'] == params[:email] }
    end

    render json: tickets
  rescue => e
    Rails.logger.error("Ticket index failed: #{e.message}\n#{e.backtrace.first(5).join("\n")}")
    render json: { error: 'Failed to read tickets' }, status: :internal_server_error
  end

  def create
    type         = params[:type]
    desc         = params[:desc]
    tenant_email = params[:tenantEmail]

    if type.blank? || desc.blank? || tenant_email.blank?
      return render json: { error: 'Missing required fields: type, desc, tenantEmail' }, status: :bad_request
    end

    tenant = TenantService.find_tenant(tenant_email)
    return render json: { error: 'Tenant not found' }, status: :not_found unless tenant

    triage      = TriageService.smart_triage(type, desc)
    attachments = upload_attachments

    ticket = build_ticket(type, desc, triage, tenant, attachments)
    TicketService.append_ticket(ticket)

    render json: ticket
  rescue => e
    Rails.logger.error("Create ticket failed: #{e.message}\n#{e.backtrace.first(5).join("\n")}")
    render json: { error: 'Failed to create ticket' }, status: :internal_server_error
  end

  def update_status
    TicketService.update_ticket_cell(params[:id], 'status', params[:status])
    render json: { success: true }
  rescue => e
    Rails.logger.error("Status update failed [#{params[:id]}]: #{e.message}")
    render json: { error: e.message }, status: :internal_server_error
  end

  def update_urgency
    TicketService.update_urgency(params[:id], params[:urgency])
    render json: { success: true }
  rescue => e
    Rails.logger.error("Urgency update failed [#{params[:id]}]: #{e.message}")
    render json: { error: e.message }, status: :internal_server_error
  end

  private

  def upload_attachments
    return [] unless params[:attachments].present?

    files = Array(params[:attachments])
    files.filter_map do |file|
      AttachmentUploadService.upload(file)
    rescue => e
      Rails.logger.error("Upload failed for #{file.original_filename}: #{e.message}")
      nil
    end
  end

  def build_ticket(type, desc, triage, tenant, attachments)
    {
      'id'                => TicketService.next_ticket_id,
      'type'              => type,
      'desc'              => desc,
      'status'            => 'open',
      'urgency'           => triage[:level],
      'urgencyOverridden' => false,
      'triageReason'      => triage[:reason],
      'time'              => Time.now.strftime('%d %b at %H:%M'),
      'tenantEmail'       => tenant['email'],
      'tenantName'        => tenant['name'],
      'location'          => tenant['location'],
      'wing'              => tenant['wing'],
      'flat'              => tenant['flat'],
      'contact'           => tenant['contact'],
      'locationEdited'    => params[:locationEdited] == 'true',
      'attachments'       => attachments
    }
  end
end
