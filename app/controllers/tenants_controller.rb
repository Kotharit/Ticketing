class TenantsController < ApplicationController
  def show
    tenant = TenantService.find_tenant(params[:email])
    if tenant
      tenant.delete('password')
      render json: tenant
    else
      render json: { error: 'Tenant not found' }, status: :not_found
    end
  end

  def update
    updates = params.permit(:location, :wing, :flat).to_h
    TenantService.update_tenant_fields(params[:email], updates)
    tenant = TenantService.find_tenant(params[:email])
    tenant.delete('password')
    render json: tenant
  rescue => e
    render json: { error: e.message }, status: :internal_server_error
  end
end
