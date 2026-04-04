class AuthController < ApplicationController
  def login
    email = params[:email].to_s
    password = params[:password].to_s
    tenant = TenantService.find_tenant(email)

    if !tenant
      render json: { error: 'Email not found' }, status: :unauthorized
    elsif tenant['password'] != password
      render json: { error: 'Wrong password' }, status: :unauthorized
    else
      tenant.delete('password')
      render json: tenant
    end
  end

  def admin_login
    if params[:username] == (ENV['ADMIN_USER'] || 'admin') && params[:password] == (ENV['ADMIN_PASS'] || 'admin123')
      render json: { success: true, role: 'admin' }
    else
      render json: { error: 'Invalid admin credentials' }, status: :unauthorized
    end
  end
end
