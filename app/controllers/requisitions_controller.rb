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
    
    # Handle invoices array
    data['invoices'] = params[:invoices] || []
    
    # Defaults
    data['submitted_at'] = Time.now.strftime("%d %b at %H:%M")
    data['admin_approval'] = 'Pending'

    RequisitionService.create_requisition(data)
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
