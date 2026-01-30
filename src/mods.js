anychart.onDocumentReady(function () {
    var chart = anychart.pie([
        { x: "2.4.1", value: 52 },
        { x: "2.4.0", value: 28 },
        { x: "2.3.x", value: 20 }
    ]);

    chart.palette(["#6aa7ff", "#3c5eff", "#9ed3ff"]);
    chart.background().fill("transparent");
    chart.labels(false);
    chart.legend(false);
    chart.innerRadius("45%");
    chart.container("mod-version-chart");
    chart.draw();
});
