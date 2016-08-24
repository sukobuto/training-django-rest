from django.conf.urls import url
from . import views

app_name = 'front_todo'
urlpatterns = [
    url(r'^$', views.IndexView.as_view()),
]
