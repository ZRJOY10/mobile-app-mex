let phoneNumber = "";
let pinStep = false;



async function login(){


    if(!pinStep){


        phoneNumber = document
            .getElementById("phone")
            .value
            .replace(/\D/g,"");



        const response = await fetch("https://login.bluend.org/login", {

            method:"POST",

            headers:{
                "Content-Type":"application/json"
            },

            body:JSON.stringify({

                phone: phoneNumber

            })

        });



        const data = await response.json();


        console.log("Phone check:", data);



        if(data.success === true){


            pinStep = true;



            document.getElementById("loginInputBox").innerHTML = `

                <label>
                    PIN
                </label>


                <input
                id="pin"
                type="password"
                placeholder="Ingresa tu PIN"
                maxlength="6">

            `;



        }


        else if(data.success === false){


            console.log("Customer exists but needs PIN");


        }


        else{


            console.log("Customer not found");


        }



    }



    else{


        const pin = document
            .getElementById("pin")
            .value;



        const response = await fetch("https://login.bluend.org/authenticate", {

            method:"POST",

            headers:{
                "Content-Type":"application/json"
            },


            body:JSON.stringify({

                phone: phoneNumber,

                pin: pin

            })

        });



        const data = await response.json();



        console.log("Authentication:", data);



        if(data.success === true){


            console.log("Logged in successfully");
            window.location.href = "../main_menu/index.html";



            // next step: save session / redirect


        }


        else{


            console.log("Incorrect PIN");


        }


    }


}
