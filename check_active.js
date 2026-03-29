fetch("https://hub.axisrobotics.ai/api/tasks?sort_order=desc&status=active&search=&page=1&per_page=90", {
    headers: {
        "accept": "application/json, text/plain, */*"
    },
    method: "GET",
    credentials: "include"
})
    .then(res => res.json())
    .then(data => {

        const tasks = data.tasks || [];

        tasks.forEach((task, i) => {
            console.log("id:", task.id, ' - progress', task.progress, ' - completed: ', task.user_has_completed);
        });

    });


