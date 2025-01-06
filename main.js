$(function () {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "http://localhost:3000/login.html";
    return;
  }
  $.ajax({
    url: "http://localhost:3000/test_login",
    beforeSend: function (xhr) {
      xhr.setRequestHeader("Authorization", "Bearer " + token);
    },
    success: function (data) {
      if (data.success) {
        $("#head").load("menu-" + data.usergroup + ".html");
      } else {
        window.location.href = "http://localhost:3000/login.html";
      }
    },
    error: function (xhr, status, error) {
      console.error("Error:", error);
      window.location.href = "http://localhost:3000/login.html";
    },
    dataType: "json",
  });
});