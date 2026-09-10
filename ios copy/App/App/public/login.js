let phoneNumber = "";
let pinStep = false;
const Preferences = window.Store;
console.log("LOGIN JS LOADED");


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


            //This Moves to phase 2 where a pin is asked. Nothing is written as this isnt a terminal stage
            document.getElementById("loginInputBox").innerHTML = `

            <label id="loginLabel"> 
                    Bienvenidos a
                    <br>
                    La Bodeguita
                </label>

                <span class="small-gap"></span>

                <span class="small-gap3"></span>


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
            //Writes the shopify customer id so that the screen can show unclaimed points


            // Here, a new shopify id need not be created

            await Preferences.set({
                 key: "data",
                 value: JSON.stringify({
                 success: false,
                 existingCustomer: true,
                 shopifyCustomerId: data.shopifyCustomerId
                        })});
            
            window.location.href = `/signup/index.html?phone=${encodeURIComponent(phoneNumber)}&newShopifyId=false&shopifyCustomerId=${encodeURIComponent(data.shopifyCustomerId)}`;



        }


        else{


            console.log("Customer not found");
            //Writes that nothing exists

            // The next stage needs to query shopify API so that a new shopify customer can be created
            await Preferences.set({
                key: "data",
                value: JSON.stringify({
                success: false,
                existingCustomer: false,
                shopifyCustomerId: null
                                       })});
            window.location.href = `/signup/index.html?phone=${encodeURIComponent(phoneNumber)}&newShopifyId=true`;
            
                                       



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



if (data.success === true) {
        await Preferences.set({
            key: "data",
            value: JSON.stringify({
                success: true,
                existingCustomer: true,
                shopifyCustomerId: data.customer.id
            })
        });

        console.log("Saved customer ID:", data.customer.id);
        const saved = await Preferences.get({key: "data"});
        console.log("Read back:", saved.value);
        window.location.href = "../main_menu/index.html";
}

else{
    console.log("Incorrect PIN");
    const pinBox = document.getElementById("pin");
    pinBox.style.border = "2px solid red";
    pinBox.style.backgroundColor = "#ffe6e6";
    pinBox.focus();
    pinBox.addEventListener(
        "input",
        function resetPinStyle() {
            pinBox.style.border = "";
            pinBox.style.backgroundColor = "";
            pinBox.removeEventListener("input", resetPinStyle);
        }
    );



    }// end authentication result


    }// end "else" of if (!pinStep)


}// end login()

window.login = login;
console.log("login function loaded");

