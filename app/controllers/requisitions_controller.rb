class RequisitionsController < ApplicationController
  def index
    render json: RequisitionService.read_requisitions
  rescue => e
    render json: { error: e.message }, status: :internal_server_error
  end

  def create
    data = params.permit(
      :ticket_id, :surveyed, :in_house_fix, :vendor_name, 
      :est_cost, :cost_breakdown, :admin_approval
    ).to_h
    
    # Handle invoices as array in all cases (single upload arrives as UploadedFile).
    raw_invoices = params[:invoices]
    normalized_invoices =
      if raw_invoices.nil?
        []
      elsif raw_invoices.is_a?(Array)
        raw_invoices
      else
        [raw_invoices]
      end
    # Upload each invoice file and collect the resulting metadata hashes.
    # Raw UploadedFile objects cannot be passed to SheetSerializer directly.
    uploaded_invoices = normalized_invoices.filter_map do |file|
      AttachmentUploadService.upload(file)
    rescue => e
      Rails.logger.error("Invoice upload failed for #{file.original_filename}: #{e.message}")
      nil
    end
    data['invoices'] = uploaded_invoices

    # Defaults
    data['submitted_at'] = Time.now.strftime("%d %b at %H:%M")
    data['admin_approval'] = 'Pending'

    RequisitionService.create_requisition(data)
    render json: { success: true }
  rescue => e
    render json: { error: e.message }, status: :internal_server_error
  end

  def confirm_vendor
    proof_file = params[:proof]
    unless proof_file
      render json: { error: 'Proof photo is required' }, status: :unprocessable_entity
      return
    end

    proof_attachment = AttachmentUploadService.upload(proof_file)
    manager_name  = params[:manager_name].to_s.strip
    confirmed_at  = Time.now.strftime("%d %b at %H:%M")

    RequisitionService.confirm_vendor(params[:id], manager_name, confirmed_at, proof_attachment)
    render json: { success: true }
  rescue => e
    render json: { error: e.message }, status: :internal_server_error
  end

  def approve
    RequisitionService.approve_requisition(params[:id], params[:remarks] || '')
    render json: { success: true }
  rescue => e
    render json: { error: e.message }, status: :internal_server_error
  end

  def reject
    RequisitionService.reject_requisition(params[:id], params[:remarks] || '')
    render json: { success: true }
  rescue => e
    render json: { error: e.message }, status: :internal_server_error
  end
end
