Rails.application.routes.draw do
  post 'api/login', to: 'auth#login'
  post 'api/admin/login', to: 'auth#admin_login'
  post 'api/manager/login', to: 'auth#manager_login'

  resources :requisitions, path: 'api/requisitions', only: [:index, :create] do
    member do
      put :approve
      put :reject
      put :confirm_vendor
    end
  end

  get 'api/tenant/:email', to: 'tenants#show', constraints: { email: /.*/ }
  put 'api/tenant/:email', to: 'tenants#update', constraints: { email: /.*/ }

  get 'api/tickets', to: 'tickets#index'
  post 'api/tickets', to: 'tickets#create'
  put 'api/tickets/:id/status', to: 'tickets#update_status'
  put 'api/tickets/:id/urgency', to: 'tickets#update_urgency'

  get 'api/attachments/:id', to: 'attachments#show', format: false, constraints: { id: /[^\/]+/ }
end
