# Handles tenant, admin, and manager authentication.
#
# All three login flows follow the same pattern (find user, compare password,
# return profile), so `role_login` captures that shared logic. The individual
# endpoints just configure which finder to use and what shape the response takes.
class AuthController < ApplicationController
  def login
    email    = params[:email].to_s.strip.downcase
    password = params[:password].to_s

    tenant = TenantService.find_tenant(email)

    if tenant.nil?
      render json: { error: 'Email not found' }, status: :unauthorized
    elsif tenant['password'] != password
      render json: { error: 'Wrong password' }, status: :unauthorized
    else
      # Strip password before sending to client
      tenant.delete('password')
      render json: tenant
    end
  end

  def admin_login
    role_login(:find_admin, 'admin')
  end

  def manager_login
    role_login(:find_manager, 'manager')
  end

  private

  # Shared login flow for staff roles (admin/manager).
  # `finder_method` is the AuthService class method to locate the user.
  # `role_name` labels the role in the response payload.
  def role_login(finder_method, role_name)
    username = params[:username].to_s.strip
    password = params[:password].to_s

    user = AuthService.public_send(finder_method, username)

    if user.nil? || user[:password] != password
      render json: { error: "Invalid #{role_name} credentials" }, status: :unauthorized
    else
      render json: { success: true, role: role_name, name: user[:name] }
    end
  end
end
