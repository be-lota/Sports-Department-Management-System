//LANDING PAGE

document.addEventListener("DOMContentLoaded", () => {

    initializeContactForm();
    initializeSmoothScroll();

});

// Contact Form
function initializeContactForm() {

    const contactForm =
        document.querySelector(".contact-form form");

    if (!contactForm) return;

    contactForm.addEventListener("submit", function (e) {

        e.preventDefault();

        const fullName =
            contactForm.querySelector('input[type="text"]').value.trim();

        const email =
            contactForm.querySelector('input[type="email"]').value.trim();

        const subject =
            contactForm.querySelectorAll('input[type="text"]')[1].value.trim();

        const message =
            contactForm.querySelector("textarea").value.trim();

        if (
            fullName === "" ||
            email === "" ||
            subject === "" ||
            message === ""
        ) {

            alert("Please fill in all the fields.");
            return;

        }

        alert(
            "Thank you for contacting us. We have received your message."
        );

        contactForm.reset();

    });

}

// Smooth-scroll for in-page anchor links (e.g. landing page nav → #about)
function initializeSmoothScroll() {

    document.querySelectorAll('a[href^="#"]').forEach(link => {

        link.addEventListener("click", function (e) {

            const targetId = this.getAttribute("href");
            if (targetId === "#") return;

            const target = document.querySelector(targetId);
            if (!target) return;

            e.preventDefault();
            target.scrollIntoView({ behavior: "smooth" });

        });

    });

}
